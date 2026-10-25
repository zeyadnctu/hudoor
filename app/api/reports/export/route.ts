import { NextRequest, NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { requirePerm } from "@/lib/guard";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/reports/export?course_id=&from=&to=&status=&student=  -> CSV (BOM for Arabic Excel)
// Auth + scoping (was an unauthenticated whole-university dump):
// - students: always forced to their own records (own-profile export)
// - professors/TAs/admins: requirePerm("attendance","export") + course ownership
// - filters are applied in SQL, not on a 5000-row JS slice
export async function GET(req: NextRequest) {
  const auth = serverSupabase();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const svc = serviceSupabase();
  const { data: profile } = await svc.from("profiles")
    .select("id,role,custom_role,status").eq("id", user.id).single();
  if (!profile || profile.status !== "approved")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = new URL(req.url).searchParams;
  const courseId = q.get("course_id") ?? "";
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const status = q.get("status") ?? "";
  const studentParam = (q.get("student") ?? "").trim();

  let forcedStudent: string | null = null;
  let forcedCourse: string[] | null = null;
  if (profile.role === "student") {
    // Own records only — course/status filters still apply, foreign ids don't.
    if (!can(profile, "attendance", "view"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    forcedStudent = profile.id;
  } else {
    // No course picked (e.g. preset reset): never widen to everything —
    // scope to the professor's/TA's own courses, then gate on ownership of
    // one of them (requirePerm needs a course for course-scoped resources).
    if (!courseId && profile.role !== "admin") {
      const [cp, tas] = await Promise.all([
        svc.from("course_professors").select("course_id").eq("professor_id", user.id),
        svc.from("course_tas").select("course_id").eq("ta_id", user.id)
      ]);
      const own = [...new Set([
        ...((cp.data ?? []) as any[]).map(r => r.course_id),
        ...((tas.data ?? []) as any[]).map(r => r.course_id)
      ])];
      if (!own.length) return NextResponse.json({ error: "course_required" }, { status: 403 });
      const gate = await requirePerm(req, "attendance", "export", { courseId: own[0] });
      if (!gate.ok) return gate.res;
      forcedCourse = own;
    } else {
      const gate = await requirePerm(req, "attendance", "export", courseId ? { courseId } : {});
      if (!gate.ok) return gate.res;
    }
  }

  let query = svc.from("attendance_records")
    .select("scanned_at,method,status,session_id,student_id,attendance_sessions!inner(course_id,starts_at,courses(code))");
  if (courseId) query = query.eq("attendance_sessions.course_id", courseId);
  else if (forcedCourse) query = query.in("attendance_sessions.course_id", forcedCourse);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("scanned_at", from + "T00:00");
  if (to) query = query.lte("scanned_at", to + "T23:59:59");
  if (forcedStudent) query = query.eq("student_id", forcedStudent);
  else if (studentParam) query = query.eq("student_id", studentParam);

  // Page through in chunks so the export isn't silently capped at one page.
  const rows: any[] = [];
  const CHUNK = 1000;
  const MAX = 20000;
  for (let from_ = 0; rows.length < MAX; from_ += CHUNK) {
    const { data, error } = await query
      .order("scanned_at", { ascending: true })
      .range(from_, from_ + CHUNK - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < CHUNK) break;
  }

  const sids = [...new Set(rows.map(r => r.student_id))];
  const { data: dets } = await svc.from("student_details")
    .select("user_id,university_id,full_name_en,full_name_ar")
    .in("user_id", sids.length ? sids : ["00000000-0000-0000-0000-000000000000"]);
  const byUser = new Map(((dets as any[]) ?? []).map(d => [d.user_id, d]));

  const header = "student_id,name_en,name_ar,course,date,status,scanned_at,method\n";
  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map(r => {
    const d: any = byUser.get(r.student_id) ?? {};
    return [
      d.university_id ?? r.student_id, esc(d.full_name_en), esc(d.full_name_ar),
      r.attendance_sessions?.courses?.code ?? "", r.scanned_at.slice(0, 10),
      r.status, r.scanned_at, r.method
    ].join(",");
  });
  const csv = "﻿" + header + lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hudoor-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}

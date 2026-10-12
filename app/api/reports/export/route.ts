import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET /api/reports/export?course_id=&from=&to=&section=&status=  -> CSV (BOM for Arabic Excel)
export async function GET(req: NextRequest) {
  const svc = serviceSupabase();
  const q = new URL(req.url).searchParams;
  const courseId = q.get("course_id");
  let query = svc.from("attendance_records").select("scanned_at,method,status,session_id,student_id, attendance_sessions!inner(course_id,starts_at,courses(code)), student_details!inner(university_id,full_name_en,full_name_ar)");
  // filter in JS for simplicity if course given
  const { data, error } = await svc.from("attendance_records").select("scanned_at,method,status,session_id,student_id, attendance_sessions!inner(course_id,starts_at,courses(code))").limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sids = [...new Set((data as any[]).map(r => r.student_id))];
  const { data: dets } = await svc.from("student_details").select("user_id,university_id,full_name_en,full_name_ar").in("user_id", sids.length ? sids : ["00000000-0000-0000-0000-000000000000"]);
  const byUser = new Map(((dets as any[]) ?? []).map(d => [d.user_id, d]));
  let rows = (data as any[]).filter(r => !courseId || r.attendance_sessions.course_id === courseId);
  const from = q.get("from"); const to = q.get("to"); const status = q.get("status");
  if (from) rows = rows.filter(r => r.scanned_at >= from);
  if (to) rows = rows.filter(r => r.scanned_at <= to);
  if (status) rows = rows.filter(r => r.status === status);
  const header = "student_id,name_en,name_ar,course,date,status,scanned_at,method\n";
  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map(r => {
    const d: any = byUser.get(r.student_id) ?? {};
    return [
      d.university_id ?? r.student_id, esc(d.full_name_en), esc(d.full_name_ar),
      r.attendance_sessions.courses.code, r.scanned_at.slice(0, 10), r.status, r.scanned_at, r.method
    ].join(",");
  });
  const csv = "﻿" + header + lines.join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=hudoor.csv" } });
}

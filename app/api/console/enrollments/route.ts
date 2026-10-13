import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { detectClashes, type Slot } from "@/lib/timetable";

export const dynamic = "force-dynamic";

async function resolveStudent(svc: any, ref: string): Promise<string | null> {
  const clean = ref.trim();
  if (!clean) return null;
  if (clean.includes("@")) {
    const { data } = await svc.from("profiles").select("id").eq("email", clean).maybeSingle();
    if (data) return data.id;
  }
  const { data } = await svc.from("student_details").select("user_id").eq("university_id", clean).maybeSingle();
  return data?.user_id ?? null;
}

/** GET enrollments of a course (students + details). */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const courseId = q.get("course_id") ?? "";
  if (!courseId) return NextResponse.json({ error: "course_required" }, { status: 400 });
  const gate = await requirePerm(req, "enrollments", "view", { courseId });
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const search = (q.get("search") ?? "").trim().replace(/[%_]/g, "");
  const section = q.get("section") ?? "";
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const perPage = Math.min(500, Math.max(1, Number(q.get("perPage") ?? 100)));
  let query = svc.from("enrollments").select("id,section,student_id", { count: "exact" }).eq("course_id", courseId);
  if (section) query = query.eq("section", section);
  const { data: enr, error, count } = await query.order("student_id").range((page - 1) * perPage, page * perPage - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sids = ((enr ?? []) as any[]).map(e => e.student_id);
  let det: Record<string, any> = {};
  let prof: Record<string, any> = {};
  if (sids.length) {
    const [d, p] = await Promise.all([
      svc.from("student_details").select("user_id,full_name_ar,full_name_en,university_id,phone,level_year,section_group").in("user_id", sids),
      svc.from("profiles").select("id,email,status").in("id", sids)
    ]);
    for (const r of (d.data ?? []) as any[]) det[r.user_id] = r;
    for (const r of (p.data ?? []) as any[]) prof[r.id] = r;
  }
  let rows = ((enr ?? []) as any[]).map(e => ({ ...e, details: det[e.student_id] ?? null, profile: prof[e.student_id] ?? null }));
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(r => `${r.details?.full_name_ar ?? ""} ${r.details?.full_name_en ?? ""} ${r.details?.university_id ?? ""} ${r.profile?.email ?? ""}`.toLowerCase().includes(s));
  }
  return NextResponse.json({ rows, total: count ?? rows.length });
}

/** POST enroll (single refs[] or bulk by department/level) with clash detection. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { course_id, refs, section, bulk } = body as {
    course_id: string; refs?: string[]; section?: string;
    bulk?: { department_id?: string; level_id?: string };
  };
  if (!course_id) return NextResponse.json({ error: "course_required" }, { status: 400 });
  const gate = await requirePerm(req, "enrollments", "create", { courseId: course_id });
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;

  let targets: string[] = refs ?? [];
  if (bulk?.department_id || bulk?.level_id) {
    let dq = svc.from("student_details").select("user_id");
    if (bulk.department_id) dq = dq.eq("department_id", bulk.department_id);
    if (bulk.level_id) dq = dq.eq("level_id", bulk.level_id);
    const { data } = await dq.limit(2000);
    targets = [...targets, ...((data ?? []) as any[]).map(d => d.user_id)];
  }
  // resolve refs (email or university_id or raw uuid) to student ids
  const sids: string[] = [];
  const missing: string[] = [];
  for (const ref of [...new Set(targets)]) {
    if (/^[0-9a-f-]{36}$/i.test(ref)) { sids.push(ref); continue; }
    const sid = await resolveStudent(svc, ref);
    if (sid) sids.push(sid); else missing.push(ref);
  }
  // clash detection: new course slots vs each student's other courses' slots
  const { data: newSlots } = await svc.from("timetable_slots").select("day,starts_at,ends_at,room_id,professor_id,section,course_id").eq("course_id", course_id);
  const conflicts: { student: string; with: string[] }[] = [];
  if ((newSlots ?? []).length && sids.length) {
    const { data: otherEnr } = await svc.from("enrollments").select("course_id,student_id").in("student_id", sids).neq("course_id", course_id);
    const byStudent = new Map<string, string[]>();
    for (const e of (otherEnr ?? []) as any[]) byStudent.set(e.student_id, [...(byStudent.get(e.student_id) ?? []), e.course_id]);
    const otherCids = [...new Set([...byStudent.values()].flat())];
    let otherSlots: any[] = [];
    if (otherCids.length) {
      const { data } = await svc.from("timetable_slots").select("day,starts_at,ends_at,course_id,courses(code)").in("course_id", otherCids);
      otherSlots = (data ?? []) as any[];
    }
    const byCourse = new Map<string, any[]>();
    for (const s of otherSlots) byCourse.set(s.course_id, [...(byCourse.get(s.course_id) ?? []), s]);
    const codeOf = new Map(otherSlots.map((s: any) => [s.course_id, s.courses?.code ?? s.course_id]));
    for (const [sid, cids] of byStudent) {
      const mine: Slot[] = [...(newSlots as any[]), ...cids.flatMap(c => (byCourse.get(c) ?? []).map((s: any) => ({ ...s })))];
      const cl = detectClashes(mine).filter(c =>
        (c.slotA.course_id === course_id) !== (c.slotB.course_id === course_id));
      if (cl.length) {
        const withCodes = [...new Set(cl.flatMap(c => [c.slotA.course_id, c.slotB.course_id]).filter(id => id !== course_id).map(id => codeOf.get(id) ?? id))];
        conflicts.push({ student: sid, with: withCodes });
      }
    }
  }

  const enrolled: string[] = [];
  for (const sid of [...new Set(sids)]) {
    const { error } = await svc.from("enrollments").upsert(
      { course_id, student_id: sid, section: section || "A" }, { onConflict: "course_id,student_id" });
    if (!error) enrolled.push(sid);
    else missing.push(`${sid} (${error.message})`);
  }
  await auditDiff(svc, gate.ctx.profile.id, "enrollments.bulk", "course", course_id, null, { enrolled: enrolled.length }, { section: section ?? "A" }, gate.ctx);
  return NextResponse.json({ ok: true, enrolled, missing, conflicts });
}

/** DELETE remove students from a course. */
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { course_id, student_ids } = body;
  if (!course_id || !student_ids?.length) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const gate = await requirePerm(req, "enrollments", "delete", { courseId: course_id });
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const { error } = await svc.from("enrollments").delete().eq("course_id", course_id).in("student_id", student_ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, "enrollments.remove", "course", course_id, { student_ids }, null, {}, gate.ctx);
  return NextResponse.json({ ok: true, removed: student_ids.length });
}

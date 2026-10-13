import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** GET feed (RLS-filtered server-side for the caller). POST send (admin anywhere; professor own courses only). */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "announcements", "view");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const { data: det } = await svc.from("student_details").select("department_id").eq("user_id", profile.id).maybeSingle();
  const { data: enr } = await svc.from("enrollments").select("course_id").eq("student_id", profile.id);
  const myCourses = ((enr ?? []) as any[]).map(e => e.course_id);
  const { data, error } = await svc.from("announcements")
    .select("id,title_ar,title_en,body_ar,body_en,created_at,author_id,audience").is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = ((data ?? []) as any[]).filter(a => {
    if (profile.role === "admin" || a.author_id === profile.id) return true;
    const au = a.audience ?? {};
    if ((au.roles ?? []).includes(profile.role)) return true;
    if ((au.course_ids ?? []).some((c: string) => myCourses.includes(c))) return true;
    if (det && (au.department_ids ?? []).includes((det as any).department_id)) return true;
    if (!(au.roles ?? []).length && !(au.course_ids ?? []).length && !(au.department_ids ?? []).length) return true; // broadcast
    return false;
  });
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "announcements", "create");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const body = await req.json();
  const { title_ar, title_en, body_ar, body_en, audience } = body;
  if (!title_ar || !body_ar) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const au = {
    roles: audience?.roles ?? [],
    course_ids: audience?.course_ids ?? [],
    department_ids: audience?.department_ids ?? [],
    sections: audience?.sections ?? []
  };
  if (profile.role !== "admin") {
    // professors/TAs may only target their own courses
    const [cp, tas] = await Promise.all([
      svc.from("course_professors").select("course_id").eq("professor_id", profile.id),
      svc.from("course_tas").select("course_id").eq("ta_id", profile.id)
    ]);
    const mine = new Set([...((cp.data ?? []) as any[]), ...((tas.data ?? []) as any[])].map(r => r.course_id));
    au.course_ids = au.course_ids.filter((c: string) => mine.has(c));
    au.roles = [];
    au.department_ids = [];
    if (!au.course_ids.length) return NextResponse.json({ error: "not_your_course" }, { status: 403 });
  }
  const { data, error } = await svc.from("announcements").insert({
    author_id: profile.id, audience: au, title_ar, title_en: title_en || title_ar,
    body_ar, body_en: body_en || body_ar
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, profile.id, "announcements.create", "announcements", data.id, null, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: data });
}

import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Replace course staff (professors + TAs), sections text, and attendance rules. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { course_id, professor_ids, ta_ids, section, attendance_rule } = body;
  if (!course_id) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const gate = await requirePerm(req, "courses", "edit", { courseId: course_id });
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const { data: before } = await svc.from("courses").select("id,section,attendance_rule").eq("id", course_id).single();

  if (professor_ids) {
    await svc.from("course_professors").delete().eq("course_id", course_id);
    if (professor_ids.length) {
      await svc.from("course_professors").insert(professor_ids.map((pid: string) => ({ course_id, professor_id: pid })));
    }
  }
  if (ta_ids) {
    await svc.from("course_tas").delete().eq("course_id", course_id);
    if (ta_ids.length) {
      await svc.from("course_tas").insert(ta_ids.map((tid: string) => ({ course_id, ta_id: tid })));
    }
  }
  const patch: any = {};
  if (typeof section === "string") patch.section = section;
  if (attendance_rule && typeof attendance_rule === "object") patch.attendance_rule = attendance_rule;
  if (Object.keys(patch).length) {
    const { error } = await svc.from("courses").update(patch).eq("id", course_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await auditDiff(svc, gate.ctx.profile.id, "courses.staff", "courses", course_id, before, patch, { professors: professor_ids?.length, tas: ta_ids?.length }, gate.ctx);
  return NextResponse.json({ ok: true });
}

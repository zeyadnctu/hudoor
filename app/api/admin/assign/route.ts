import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/auth";

const assignSchema = z.object({
  action: z.enum(["assign_professor", "enroll_student", "enroll_csv"]),
  course_id: z.string().uuid(),
  professor_id: z.string().uuid().optional(),
  student_ref: z.string().optional(), // email or university_id
  csv: z.string().optional() // one email or university_id per line
});

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

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = assignSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const v = body.data;

  if (v.action === "assign_professor") {
    if (!v.professor_id) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const { error } = await ctx.svc.from("course_professors").upsert(
      { course_id: v.course_id, professor_id: v.professor_id }, { onConflict: "course_id,professor_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await audit(ctx.svc, ctx.adminId, "assign_professor", "course", v.course_id, { professor: v.professor_id });
    return NextResponse.json({ ok: true });
  }

  const refs = v.action === "enroll_csv"
    ? (v.csv ?? "").split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
    : (v.student_ref ? [v.student_ref] : []);
  const enrolled: string[] = [];
  const missing: string[] = [];
  for (const ref of refs) {
    const sid = await resolveStudent(ctx.svc, ref);
    if (!sid) { missing.push(ref); continue; }
    const { error } = await ctx.svc.from("enrollments").upsert(
      { course_id: v.course_id, student_id: sid }, { onConflict: "course_id,student_id" }
    );
    if (error) missing.push(`${ref} (${error.message})`);
    else enrolled.push(ref);
  }
  await audit(ctx.svc, ctx.adminId, "enroll", "course", v.course_id, { enrolled: enrolled.length, missing });
  return NextResponse.json({ ok: true, enrolled, missing });
}

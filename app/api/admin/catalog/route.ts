import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/auth";

const catalogSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("faculty"), name_en: z.string().min(1), name_ar: z.string().min(1) }),
  z.object({ kind: z.literal("department"), faculty_id: z.string().uuid(), name_en: z.string().min(1), name_ar: z.string().min(1) }),
  z.object({ kind: z.literal("semester"), name: z.string().min(1), starts_at: z.string().min(1), ends_at: z.string().min(1), is_current: z.boolean().default(false) }),
  z.object({
    kind: z.literal("course"), code: z.string().min(1), name_en: z.string().min(1), name_ar: z.string().min(1),
    faculty_id: z.string().uuid().nullish(), department_id: z.string().uuid().nullish(),
    semester_id: z.string().uuid().nullish(), section: z.string().default("A")
  })
]);

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = catalogSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const v = body.data as any;
  let table = "";
  let row: any = {};
  if (v.kind === "faculty") { table = "faculties"; row = { name_en: v.name_en, name_ar: v.name_ar }; }
  if (v.kind === "department") { table = "departments"; row = { faculty_id: v.faculty_id, name_en: v.name_en, name_ar: v.name_ar }; }
  if (v.kind === "semester") {
    table = "semesters"; row = { name: v.name, starts_at: v.starts_at, ends_at: v.ends_at, is_current: v.is_current };
    if (v.is_current) await ctx.svc.from("semesters").update({ is_current: false }).neq("id", "00000000-0000-0000-0000-000000000000");
  }
  if (v.kind === "course") {
    table = "courses";
    row = { code: v.code, name_en: v.name_en, name_ar: v.name_ar, faculty_id: v.faculty_id ?? null, department_id: v.department_id ?? null, semester_id: v.semester_id ?? null, section: v.section };
  }
  const { data, error } = await ctx.svc.from(table).insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await audit(ctx.svc, ctx.adminId, `${v.kind}_create`, table, data.id, row);
  return NextResponse.json({ ok: true, row: data });
}

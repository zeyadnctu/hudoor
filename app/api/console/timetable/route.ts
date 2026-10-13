import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { detectClashes, expandSemester, type Slot } from "@/lib/timetable";

export const dynamic = "force-dynamic";

/** GET slots (semester/day filters). POST create. PATCH move/edit. DELETE remove. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const semester = q.get("semester_id") ?? "";
  const day = q.get("day") ?? "";
  let query = svc.from("timetable_slots")
    .select("*,courses(code,name_ar),rooms(name_ar),profiles!timetable_slots_professor_id_fkey(id)").is("deleted_at", null)
    .order("day").order("starts_at");
  // FK-name-safe: fall back to plain select if the embedded join fails
  let { data, error } = await query.limit(2000).then(
    r => r,
    async () => ({ data: [] as any[], error: { message: "join_failed" } as any })
  );
  if (error || !data) {
    const retry = await svc.from("timetable_slots").select("*,courses(code,name_ar),rooms(name_ar)").is("deleted_at", null).order("day").order("starts_at").limit(2000);
    data = retry.data;
    error = retry.error as any;
  }
  if (error) return NextResponse.json({ error: (error as any).message }, { status: 500 });
  let rows = (data ?? []) as any[];
  if (semester) rows = rows.filter(r => r.semester_id === semester);
  if (day !== "") rows = rows.filter(r => String(r.day) === day);
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "create");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { semester_id, course_id, professor_id, room_id, section, group_name, day, starts_at, ends_at } = body;
  if (!semester_id || !course_id || day === undefined || !starts_at || !ends_at)
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (starts_at >= ends_at) return NextResponse.json({ error: "bad_time" }, { status: 400 });
  const { data: existing } = await svc.from("timetable_slots").select("day,starts_at,ends_at,room_id,professor_id,section,course_id").is("deleted_at", null).eq("semester_id", semester_id);
  const clashes = detectClashes([...((existing ?? []) as Slot[]), { day, starts_at, ends_at, room_id, professor_id, section, course_id } as Slot])
    .filter(c => (c.slotA as any).course_id === course_id || (c.slotB as any).course_id === course_id);
  const { data, error } = await svc.from("timetable_slots").insert({
    semester_id, course_id, professor_id: professor_id || null, room_id: room_id || null,
    section: section || "A", group_name: group_name || "", day, starts_at, ends_at
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, "timetable.create", "timetable_slots", data.id, null, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: data, clashes });
}

export async function PATCH(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "edit");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const allowed = ["semester_id", "course_id", "professor_id", "room_id", "section", "group_name", "day", "starts_at", "ends_at"];
  const values: any = {};
  for (const k of allowed) if (rest[k] !== undefined) values[k] = rest[k] === "" ? null : rest[k];
  if (values.starts_at && values.ends_at && values.starts_at >= values.ends_at)
    return NextResponse.json({ error: "bad_time" }, { status: 400 });
  const { data: before } = await svc.from("timetable_slots").select("*").eq("id", id).single();
  const { data, error } = await svc.from("timetable_slots").update(values).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, "timetable.edit", "timetable_slots", id, before, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "delete");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
  if (!ids.length) return NextResponse.json({ error: "missing_ids" }, { status: 400 });
  const { error } = await svc.from("timetable_slots").update({ deleted_at: new Date().toISOString() }).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, "timetable.delete", "timetable_slots", ids.join(","), { ids }, null, {}, gate.ctx);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const gate = await requirePerm(req, "sessions", "create");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { semester_id, from, to, course_id } = body;
  if (!semester_id || !from || !to) return NextResponse.json({ error: "invalid" }, { status: 400 });
  let q = svc.from("timetable_slots").select("*").eq("semester_id", semester_id).is("deleted_at", null);
  if (course_id) q = q.eq("course_id", course_id);
  const { data: slots } = await q;
  const { data: blocks } = await svc.from("academic_blocks").select("starts_at,ends_at").eq("semester_id", semester_id);
  const pairs = expandSemester(
    ((slots ?? []) as any[]).map(s => ({ day: s.day, starts_at: s.starts_at.slice(0, 5), ends_at: s.ends_at.slice(0, 5), room_id: s.room_id, professor_id: s.professor_id, section: s.section, course_id: s.course_id })),
    from, to, ((blocks ?? []) as any[])
  );
  let created = 0;
  for (const p of pairs.slice(0, 500)) {
    const slot: any = p.slot;
    const { data: course } = await svc.from("courses").select("id").eq("id", slot.course_id).single();
    if (!course) continue;
    const starts = `${p.date}T${slot.starts_at}:00`;
    const ends = `${p.date}T${slot.ends_at}:00`;
    const { data: dup } = await svc.from("attendance_sessions").select("id").eq("course_id", slot.course_id).gte("starts_at", starts).lt("starts_at", ends).maybeSingle();
    if (dup) continue;
    const secret = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
    const profId = slot.professor_id ?? (await svc.from("course_professors").select("professor_id").eq("course_id", slot.course_id).limit(1).maybeSingle().then(r => (r.data as any)?.professor_id ?? null));
    if (!profId) continue;
    const { error } = await svc.from("attendance_sessions").insert({
      course_id: slot.course_id, professor_id: profId,
      starts_at: starts, ends_at: ends, secret, status: "scheduled",
      room_id: slot.room_id ?? null, source: "timetable"
    });
    if (!error) created++;
  }
  await auditDiff(svc, gate.ctx.profile.id, "sessions.generate", "semester", semester_id, null, { created }, { from, to }, gate.ctx);
  return NextResponse.json({ ok: true, created });
}

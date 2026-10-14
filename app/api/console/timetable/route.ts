import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff, myPrograms, inProgramScope } from "@/lib/guard";
import { detectClashes, type Slot } from "@/lib/timetable";
import { expandSlotOccurrences, type GridPeriod } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

/** GET slots (semester/day/program/level/group filters). POST create. PATCH move/edit. DELETE remove. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "view");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const semester = q.get("semester_id") ?? "";
  const day = q.get("day") ?? "";
  const program = q.get("program_id") ?? "";
  const level = q.get("level_id") ?? "";
  const group = q.get("group_id") ?? "";
  let query = svc.from("timetable_slots")
    .select("*,courses(code,name_ar,program_id),rooms(name_ar),profiles!timetable_slots_professor_id_fkey(id)").is("deleted_at", null)
    .order("day").order("starts_at");
  // FK-name-safe: fall back to plain select if the embedded join fails
  let { data, error } = await query.limit(2000).then(
    r => r,
    async () => ({ data: [] as any[], error: { message: "join_failed" } as any })
  );
  if (error || !data) {
    const retry = await svc.from("timetable_slots").select("*,courses(code,name_ar,program_id),rooms(name_ar)").is("deleted_at", null).order("day").order("starts_at").limit(2000);
    data = retry.data;
    error = retry.error as any;
  }
  if (error) return NextResponse.json({ error: (error as any).message }, { status: 500 });
  let rows = (data ?? []) as any[];
  if (semester) rows = rows.filter(r => r.semester_id === semester);
  if (day !== "") rows = rows.filter(r => String(r.day) === day);
  if (program) rows = rows.filter(r => (r.program_id ?? r.courses?.program_id) === program);
  if (level) rows = rows.filter(r => r.level_id === level);
  if (group) rows = rows.filter(r => r.group_id === group);
  // coordinators only ever see their programs
  const scope = await myPrograms(svc, profile);
  if (scope !== null) rows = rows.filter(r => scope.includes(r.program_id));
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "create");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const body = await req.json();
  const { semester_id, course_id, professor_id, room_id, section, group_name, day, starts_at, ends_at,
    program_id, level_id, group_id, session_type, instructor_id, instructor_name, start_period, period_count, source } = body;
  if (!semester_id || !course_id || day === undefined || !starts_at || !ends_at)
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (starts_at >= ends_at) return NextResponse.json({ error: "bad_time" }, { status: 400 });
  const scope = await myPrograms(svc, profile);
  let prog = program_id ?? null;
  if (!prog) {
    const { data: c } = await svc.from("courses").select("program_id").eq("id", course_id).single();
    prog = (c as any)?.program_id ?? null;
  }
  if (!inProgramScope(scope, prog)) return NextResponse.json({ error: "not_your_program" }, { status: 403 });
  const { data: existing } = await svc.from("timetable_slots").select("day,starts_at,ends_at,room_id,professor_id,section,course_id").is("deleted_at", null).eq("semester_id", semester_id);
  const clashes = detectClashes([...((existing ?? []) as Slot[]), { day, starts_at, ends_at, room_id, professor_id, section, course_id } as Slot])
    .filter(c => (c.slotA as any).course_id === course_id || (c.slotB as any).course_id === course_id);
  const { data, error } = await svc.from("timetable_slots").insert({
    semester_id, course_id, professor_id: professor_id || null, room_id: room_id || null,
    section: section || "A", group_name: group_name || "", day, starts_at, ends_at,
    program_id: prog, level_id: level_id || null, group_id: group_id || null,
    session_type: session_type ?? null, instructor_id: instructor_id || null,
    instructor_name: instructor_name || null,
    start_period: start_period ?? null, period_count: period_count ?? 1,
    source: source ?? "manual"
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
  const allowed = ["semester_id", "course_id", "professor_id", "room_id", "section", "group_name", "day", "starts_at", "ends_at",
    "program_id", "level_id", "group_id", "session_type", "instructor_id", "instructor_name", "start_period", "period_count", "source"];
  const values: any = {};
  for (const k of allowed) if (rest[k] !== undefined) values[k] = rest[k] === "" ? null : rest[k];
  if (values.starts_at && values.ends_at && values.starts_at >= values.ends_at)
    return NextResponse.json({ error: "bad_time" }, { status: 400 });
  const { data: before } = await svc.from("timetable_slots").select("*").eq("id", id).single();
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const effProgram = values.program_id ?? (before as any).program_id ?? null;
  if (!effProgram && values.course_id) {
    const { data: c } = await svc.from("courses").select("program_id").eq("id", values.course_id).single();
    if (c && !inProgramScope(await myPrograms(svc, gate.ctx.profile), (c as any).program_id))
      return NextResponse.json({ error: "not_your_program" }, { status: 403 });
  } else if (!inProgramScope(await myPrograms(svc, gate.ctx.profile), effProgram)) {
    return NextResponse.json({ error: "not_your_program" }, { status: 403 });
  }
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
  const { svc, profile } = gate.ctx;
  const body = await req.json();
  const { semester_id, from, to, course_id, slot_ids } = body as {
    semester_id?: string; from?: string; to?: string; course_id?: string; slot_ids?: string[];
  };
  if (!semester_id) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: sem } = await svc.from("semesters").select("starts_at,ends_at").eq("id", semester_id).single();
  if (!sem) return NextResponse.json({ error: "bad_semester" }, { status: 400 });
  const startISO = (from ?? (sem as any).starts_at).slice(0, 10);
  const endISO = (to ?? (sem as any).ends_at).slice(0, 10);
  let q = svc.from("timetable_slots").select("*").eq("semester_id", semester_id).is("deleted_at", null);
  if (course_id) q = q.eq("course_id", course_id);
  if (slot_ids?.length) q = q.in("id", slot_ids);
  const { data: slots } = await q;
  const scope = await myPrograms(svc, profile);
  const inScope = ((slots ?? []) as any[]).filter(s => {
    const pid = s.program_id;
    if (pid) return inProgramScope(scope, pid);
    return true; // legacy program-less slot: course check below
  });
  // resolve course program for legacy slots and drop out-of-scope ones
  const cids = [...new Set(inScope.map(s => s.course_id))];
  let progOf: Record<string, string | null> = {};
  if (cids.length) {
    const { data: cs } = await svc.from("courses").select("id,program_id").in("id", cids);
    for (const c of (cs ?? []) as any[]) progOf[c.id] = c.program_id ?? null;
  }
  const scoped = inScope.filter(s => {
    const pid = s.program_id ?? progOf[s.course_id] ?? null;
    return inProgramScope(scope, pid) || (!pid && scope === null);
  });
  const { data: blocks } = await svc.from("academic_blocks").select("starts_at,ends_at").eq("semester_id", semester_id);
  // grid for period-model slots (global fallback; program override when uniform)
  const { data: gridRows } = await svc.from("app_settings").select("scope_type,scope_id,value").eq("key", "period_grid");
  const gridFor = (pid: string | null): GridPeriod[] => {
    const hit = ((gridRows ?? []) as any[]).find(r => r.scope_type === "program" && r.scope_id === pid)
      ?? ((gridRows ?? []) as any[]).find(r => r.scope_type === "global" && !r.scope_id);
    return Array.isArray(hit?.value) ? hit.value : [];
  };
  const nowISO = new Date().toISOString();
  let created = 0, removed = 0, skipped = 0;
  for (const s of scoped) {
    const grid = gridFor(s.program_id ?? progOf[s.course_id] ?? null);
    const pairs = expandSlotOccurrences(
      { id: s.id, day: s.day, start_period: s.start_period, period_count: s.period_count, starts_at: String(s.starts_at).slice(0, 5), ends_at: String(s.ends_at).slice(0, 5) },
      startISO, endISO, grid, ((blocks ?? []) as any[])
    );
    // regenerate: drop future unstarted record-free occurrences of this slot
    const { data: existing } = await svc.from("attendance_sessions").select("id,starts_at,status").eq("slot_id", s.id).gt("starts_at", nowISO);
    for (const e of (existing ?? []) as any[]) {
      if (e.status !== "scheduled" && e.status !== "cancelled") { skipped++; continue; }
      const { count } = await svc.from("attendance_records").select("id", { count: "exact", head: true }).eq("session_id", e.id);
      if ((count ?? 0) > 0) { skipped++; continue; }
      await svc.from("attendance_sessions").delete().eq("id", e.id);
      removed++;
    }
    for (const p of pairs.slice(0, 500)) {
      const starts = `${p.date}T${p.starts_at}:00`;
      const ends = `${p.date}T${p.ends_at}:00`;
      if (starts <= nowISO) continue; // only future occurrences
      const { data: dup } = await svc.from("attendance_sessions").select("id").eq("course_id", s.course_id).gte("starts_at", starts).lt("starts_at", ends).maybeSingle();
      if (dup) continue;
      const secret = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
      const profId = s.instructor_id ?? s.professor_id ?? (await svc.from("course_professors").select("professor_id").eq("course_id", s.course_id).limit(1).maybeSingle().then(r => (r.data as any)?.professor_id ?? null));
      if (!profId) continue;
      const { error } = await svc.from("attendance_sessions").insert({
        course_id: s.course_id, professor_id: profId,
        starts_at: starts, ends_at: ends, secret, status: "scheduled",
        room_id: s.room_id ?? null, source: "timetable", slot_id: s.id
      });
      if (!error) created++;
    }
  }
  await auditDiff(svc, gate.ctx.profile.id, "sessions.generate", "semester", semester_id, null, { created, removed, skipped }, { from: startISO, to: endISO }, gate.ctx);
  return NextResponse.json({ ok: true, created, removed, skipped });
}

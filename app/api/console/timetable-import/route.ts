import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff, myPrograms, inProgramScope } from "@/lib/guard";
import { extractTimetable, type ParsedRow } from "@/lib/timetable-pdf";
import { bestMatches } from "@/lib/match";
import { detectClashes, expandSemester, type Slot } from "@/lib/timetable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function bucket(svc: any) {
  try { await svc.storage.createBucket("timetable-pdfs", { private: true }); } catch {}
}

/** GET list versions (?list=1) | detail (?id=) | match suggestions (?match=1&id=). */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";

  if (q.get("match") === "1" && id) {
    const { data: imp } = await svc.from("timetable_imports").select("parsed").eq("id", id).single();
    const rows = ((imp as any)?.parsed ?? []) as ParsedRow[];
    const [courses, profs, rooms] = await Promise.all([
      svc.from("courses").select("id,code,name_ar,name_en").limit(500),
      svc.from("profiles").select("id,email").eq("role", "professor").limit(500),
      svc.from("rooms").select("id,name_ar,name_en").limit(500)
    ]);
    const det = await svc.from("student_details").select("user_id,full_name_ar").in("user_id", ((profs.data ?? []) as any[]).map(p => p.id)).then(r => r, async () => ({ data: [] as any[] }));
    void det;
    const { data: pdet } = await svc.from("student_details").select("user_id,full_name_ar").in("user_id", ((profs.data ?? []) as any[]).map((p: any) => p.id));
    const pname = new Map(((pdet ?? []) as any[]).map((d: any) => [d.user_id, d.full_name_ar]));
    return NextResponse.json({
      suggestions: rows.map(r => ({
        course: bestMatches(`${r.course}`, (courses.data ?? []) as any[], c => `${c.code} ${c.name_ar} ${c.name_en}`),
        professor: bestMatches(r.professor, (profs.data ?? []) as any[], p => `${p.email} ${pname.get(p.id) ?? ""}`),
        room: bestMatches(r.room, (rooms.data ?? []) as any[], x => `${x.name_ar} ${x.name_en}`)
      }))
    });
  }

  if (id) {
    const { data } = await svc.from("timetable_imports").select("*").eq("id", id).single();
    return NextResponse.json({ row: data });
  }
  const { data } = await svc.from("timetable_imports").select("id,filename,status,created_at,report").order("created_at", { ascending: false }).limit(30);
  return NextResponse.json({ rows: data });
}

/** POST upload PDF → parse → draft (never writes slots until commit). */
export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "create");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const replaces = (form.get("replaces") as string) || null;
  if (!file || !/pdf$/i.test(file.name) && file.type !== "application/pdf")
    return NextResponse.json({ error: "need_pdf" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "too_large" }, { status: 400 });

  await bucket(svc);
  const buf = Buffer.from(await file.arrayBuffer());
  const path = `imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await svc.storage.from("timetable-pdfs").upload(path, buf, { contentType: "application/pdf" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  let parsed: ParsedRow[] = [];
  let method = "text";
  let note = "";
  try {
    const out = await extractTimetable(buf, { ocr: true, maxPages: 50 });
    parsed = out.rows;
    method = out.method;
    if (!parsed.length) note = "no_text_layer";
  } catch (e: any) {
    note = `parse_failed:${e.message}`;
  }
  const { data, error } = await svc.from("timetable_imports").insert({
    filename: file.name, storage_path: path, status: "draft",
    parsed, report: { method, note, pages: parsed.length, replaces },
    replaces_id: replaces, created_by: gate.ctx.profile.id
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auditDiff(svc, gate.ctx.profile.id, "timetable.import_upload", "timetable_imports", data.id, null, { filename: file.name, rows: parsed.length }, { method }, gate.ctx);
  return NextResponse.json({ ok: true, id: data.id, rows: parsed, method, note });
}

/** PATCH commit (validated rows + clash report) | generate sessions. DELETE rollback. */
export async function PATCH(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "create");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { id, rows, generate, from, to } = body as {
    id: string; rows: any[]; generate?: boolean; from?: string; to?: string;
  };
  const { data: imp } = await svc.from("timetable_imports").select("*").eq("id", id).single();
  if (!imp || (imp as any).status === "committed")
    return NextResponse.json({ error: "bad_state" }, { status: 400 });

  const clean = (rows ?? []).filter(r => r.course_id && r.day !== "" && r.starts_at && r.ends_at);
  // program scope (coordinators): every row must belong to an in-scope program
  {
    const scope = await myPrograms(svc, gate.ctx.profile);
    if (scope !== null) {
      const cids = [...new Set(clean.map((r: any) => r.course_id))];
      const progOf: Record<string, string | null> = {};
      if (cids.length) {
        const { data: cs } = await svc.from("courses").select("id,program_id").in("id", cids);
        for (const c of (cs ?? []) as any[]) progOf[c.id] = c.program_id ?? null;
      }
      const bad = clean.filter((r: any) => !inProgramScope(scope, r.program_id ?? progOf[r.course_id] ?? null));
      if (bad.length) return NextResponse.json({ error: "not_your_program" }, { status: 403 });
    }
  }
  // clash report across existing + new
  const semId = clean[0]?.semester_id ?? null;
  let existing: any[] = [];
  if (semId) {
    const { data } = await svc.from("timetable_slots").select("day,starts_at,ends_at,room_id,professor_id,section,course_id").eq("semester_id", semId).is("deleted_at", null);
    existing = (data ?? []) as any[];
  }
  const asSlots: Slot[] = clean.map((r: any) => ({
    day: Number(r.day), starts_at: r.starts_at, ends_at: r.ends_at,
    room_id: r.room_id || null, professor_id: r.professor_id || null,
    section: r.section || "A", group_name: r.group || "", course_id: r.course_id
  }));
  const clashes = detectClashes([...existing, ...asSlots]);

  const slotIds: string[] = [];
  for (const r of clean) {
    const { data, error } = await svc.from("timetable_slots").insert({
      semester_id: r.semester_id, course_id: r.course_id,
      professor_id: r.professor_id || null, room_id: r.room_id || null,
      section: r.section || "A", group_name: r.group || "",
      day: Number(r.day), starts_at: r.starts_at, ends_at: r.ends_at, import_id: id,
      program_id: r.program_id ?? null, level_id: r.level_id ?? null, group_id: r.group_id ?? null,
      session_type: r.session_type ?? null, instructor_id: r.instructor_id ?? r.professor_id ?? null,
      instructor_name: r.instructor_name ?? null,
      start_period: r.start_period ?? null, period_count: r.period_count ?? 1,
      source: "import", source_ref: id
    }).select("id").single();
    if (!error && data) slotIds.push((data as any).id);
  }

  let generated = 0;
  if (generate && from && to && semId) {
    const { data: blocks } = await svc.from("academic_blocks").select("starts_at,ends_at").eq("semester_id", semId);
    const pairs = expandSemester(asSlots, from, to, ((blocks ?? []) as any[]));
    for (const p of pairs.slice(0, 500)) {
      const s: any = p.slot;
      const starts = `${p.date}T${s.starts_at}:00`;
      const ends = `${p.date}T${s.ends_at}:00`;
      const { data: dup } = await svc.from("attendance_sessions").select("id").eq("course_id", s.course_id).gte("starts_at", starts).lt("starts_at", ends).maybeSingle();
      if (dup) continue;
      const profId = s.professor_id ?? (await svc.from("course_professors").select("professor_id").eq("course_id", s.course_id).limit(1).maybeSingle().then(r => (r.data as any)?.professor_id ?? null));
      if (!profId) continue;
      const secret = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
      const { error } = await svc.from("attendance_sessions").insert({
        course_id: s.course_id, professor_id: profId, starts_at: starts, ends_at: ends,
        secret, status: "scheduled", room_id: s.room_id ?? null, source: "import"
      });
      if (!error) generated++;
    }
  }

  await svc.from("timetable_imports").update({
    status: "committed", slot_ids: slotIds,
    report: { ...((imp as any).report ?? {}), committed: slotIds.length, clashes: clashes.length, generated }
  }).eq("id", id);
  await auditDiff(svc, gate.ctx.profile.id, "timetable.import_commit", "timetable_imports", id, { status: "draft" }, { status: "committed", slots: slotIds.length }, { generated }, gate.ctx);
  return NextResponse.json({ ok: true, slots: slotIds.length, clashes, generated });
}

export async function DELETE(req: NextRequest) {
  const gate = await requirePerm(req, "timetable", "delete");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const { data: imp } = await svc.from("timetable_imports").select("*").eq("id", id).single();
  if (!imp) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const slotIds: string[] = (imp as any).slot_ids ?? [];
  if (slotIds.length) {
    await svc.from("timetable_slots").update({ deleted_at: new Date().toISOString() }).in("id", slotIds);
  }
  await svc.from("timetable_imports").update({ status: "rolled_back" }).eq("id", id);
  await auditDiff(svc, gate.ctx.profile.id, "timetable.import_rollback", "timetable_imports", id, { status: (imp as any).status }, { status: "rolled_back", slots: slotIds.length }, {}, gate.ctx);
  return NextResponse.json({ ok: true, removed: slotIds.length });
}

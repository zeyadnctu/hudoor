import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

const TRASH_TABLES = ["faculties", "departments", "programs", "courses", "semesters", "buildings", "rooms", "timetable_slots", "announcements"] as const;
const LABEL_COL: Record<string, string> = {
  faculties: "name_ar", departments: "name_ar", programs: "code", courses: "code",
  semesters: "name", buildings: "name_ar", rooms: "name_ar",
  timetable_slots: "section", announcements: "title_ar"
};

/** GET union of soft-deleted rows. POST restore|purge items. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "trash", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const out: any[] = [];
  for (const t of TRASH_TABLES) {
    const { data } = await svc.from(t).select(`id,deleted_at,${LABEL_COL[t]}`).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(200);
    for (const r of (data ?? []) as any[]) out.push({ table: t, id: r.id, label: r[LABEL_COL[t]], deleted_at: r.deleted_at });
  }
  out.sort((a, b) => (b.deleted_at > a.deleted_at ? 1 : -1));
  return NextResponse.json({ rows: out });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "trash", "delete");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { action, items } = body as { action: "restore" | "purge"; items: { table: string; id: string }[] };
  if (!["restore", "purge"].includes(action) || !items?.length)
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  let n = 0;
  for (const it of items.slice(0, 200)) {
    if (!TRASH_TABLES.includes(it.table as any)) continue;
    if (action === "restore") {
      const { error } = await svc.from(it.table).update({ deleted_at: null }).eq("id", it.id);
      if (!error) n++;
    } else {
      const { error } = await svc.from(it.table).delete().eq("id", it.id);
      if (!error) n++;
    }
  }
  await auditDiff(svc, gate.ctx.profile.id, `trash.${action}`, "trash", null, null, { count: n }, {}, gate.ctx);
  return NextResponse.json({ ok: true, count: n });
}

import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** GET flagged attempts. POST warn|block|clear with audit. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "flags", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const perPage = Math.min(200, Math.max(1, Number(q.get("perPage") ?? 50)));
  const { data, error, count } = await svc.from("flagged_attempts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const uids = [...new Set(((data ?? []) as any[]).map((f: any) => f.user_id).filter(Boolean))];
  let emails: Record<string, string> = {};
  if (uids.length) {
    const { data: p } = await svc.from("profiles").select("id,email").in("id", uids);
    for (const r of (p ?? []) as any[]) emails[r.id] = r.email;
  }
  return NextResponse.json({
    rows: ((data ?? []) as any[]).map((f: any) => ({ ...f, user_email: emails[f.user_id] ?? null })),
    total: count ?? 0
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, action, comment } = body as { id?: string; action: "warn" | "block" | "clear" | "flag"; comment?: string };
  if (action === "flag") {
    // professor+ creation path (course-scoped via session)
    const gate = await requirePerm(req, "flags", "create", body.session_id ? { sessionId: body.session_id } : {});
    if (!gate.ok) return gate.res;
    if (!body.user_id) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const { data, error } = await gate.ctx.svc.from("flagged_attempts").insert({
      user_id: body.user_id, session_id: body.session_id ?? null,
      reason: body.reason ?? "professor_flag", device_id: gate.ctx.deviceId, ip: gate.ctx.ip,
      metadata: { by: gate.ctx.profile.id, note: comment ?? "" }
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(gate.ctx.svc, gate.ctx.profile.id, "flags.flag", "flagged_attempts", data.id, null, data, {}, gate.ctx);
    return NextResponse.json({ ok: true });
  }
  const gate = await requirePerm(req, "flags", "manage");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  if (!id || !["warn", "block", "clear"].includes(action as string)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: flag } = await svc.from("flagged_attempts").select("*").eq("id", id).single();
  if (!flag) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "clear") {
    await svc.from("flagged_attempts").delete().eq("id", id);
  } else if (action === "warn" && (flag as any).user_id) {
    await svc.from("announcements").insert({
      author_id: gate.ctx.profile.id,
      audience: { roles: [], course_ids: [], department_ids: [], sections: [] },
      title_ar: "تنبيه حضور", title_en: "Attendance warning",
      body_ar: `رُصدت محاولة مرفوضة (${(flag as any).reason}). ${comment ?? "التزم بالمسح من داخل القاعة وجهازك المسجل."}`,
      body_en: `A rejected attempt was recorded (${(flag as any).reason}). ${comment ?? ""}`
    });
    // targeted warn: store user in metadata path via direct device? keep broadcast-safe: only audit
  } else if (action === "block" && (flag as any).user_id) {
    await svc.from("profiles").update({ is_active: false, status: "suspended" }).eq("id", (flag as any).user_id);
  }
  await auditDiff(svc, gate.ctx.profile.id, `flags.${action}`, "flagged_attempts", id, flag, { action }, { comment: comment ?? "" }, gate.ctx);
  return NextResponse.json({ ok: true });
}

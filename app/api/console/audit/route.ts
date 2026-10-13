import { NextRequest, NextResponse } from "next/server";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** GET filterable audit log (+ ?format=csv export with BOM). */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "audit", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const perPage = Math.min(500, Math.max(1, Number(q.get("perPage") ?? 50)));
  const action = q.get("action") ?? "";
  const entity = q.get("entity") ?? "";
  const actor = q.get("actor") ?? "";
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  let query = svc.from("audit_logs").select("*", { count: "exact" });
  if (action) query = query.ilike("action", `%${action}%`);
  if (entity) query = query.eq("entity_type", entity);
  if (actor) query = query.eq("actor_id", actor);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59");
  const { data, error, count } = await query.order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (q.get("format") === "csv") {
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const head = "time,actor,action,entity,entity_id,ip,before,after\n";
    const lines = ((data ?? []) as any[]).map(a => [
      a.created_at, a.actor_id, a.action, a.entity_type, a.entity_id ?? "",
      a.ip ?? "", esc(JSON.stringify(a.before_data ?? "")), esc(JSON.stringify(a.after_data ?? ""))
    ].join(","));
    return new NextResponse("﻿" + head + lines.join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=audit.csv" }
    });
  }
  // actor emails for display
  const aids = [...new Set(((data ?? []) as any[]).map(a => a.actor_id).filter(Boolean))];
  let emails: Record<string, string> = {};
  if (aids.length) {
    const { data: p } = await svc.from("profiles").select("id,email").in("id", aids);
    for (const r of (p ?? []) as any[]) emails[r.id] = r.email;
  }
  return NextResponse.json({ rows: (data ?? []).map((a: any) => ({ ...a, actor_email: emails[a.actor_id] ?? null })), total: count ?? 0 });
}

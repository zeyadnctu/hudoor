import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Service requests: device reset / data change (student creates, admin manages). */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "requests", "view");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const status = q.get("status") ?? "";
  let query = svc.from("service_requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (profile.role !== "admin") query = query.eq("student_id", profile.id);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "requests", "create");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const body = await req.json();
  const { type, payload } = body as { type: "device_reset" | "data_change"; payload?: any };
  if (!["device_reset", "data_change"].includes(type)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: dup } = await svc.from("service_requests").select("id").eq("student_id", profile.id).eq("type", type).eq("status", "pending").maybeSingle();
  if (dup) return NextResponse.json({ error: "already_pending" }, { status: 400 });
  const { data, error } = await svc.from("service_requests").insert({
    type, student_id: profile.id, payload: payload ?? {}
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, profile.id, "requests.create", "service_requests", data.id, null, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: data });
}

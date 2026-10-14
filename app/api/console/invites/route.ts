import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { randomBytes, createHash } from "crypto";

export const dynamic = "force-dynamic";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** GET list. POST create | generate link | revoke. DELETE remove. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "users", "view");
  if (!gate.ok) return gate.res;
  const { data, error } = await gate.ctx.svc.from("instructor_invites")
    .select("*,programs(code)").order("created_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    rows: ((data ?? []) as any[]).map(r => ({
      ...r, token_hash: undefined,
      state: r.claimed_by ? "claimed" : new Date(r.expires_at) < new Date() ? "expired" : "pending"
    }))
  });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "users", "create");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { action } = body;

  if (!action || action === "create") {
    const { full_name, title, role, program_id } = body;
    if (!full_name?.trim() || !["Dr", "Eng"].includes(title))
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    const { data, error } = await svc.from("instructor_invites").insert({
      full_name: full_name.trim(), title,
      role: role === "student" || role === "admin" ? role : "professor",
      program_id: program_id || null, created_by: gate.ctx.profile.id
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, gate.ctx.profile.id, "invites.create", "instructor_invites", data.id, null, data, {}, gate.ctx);
    return NextResponse.json({ ok: true, row: data });
  }

  if (action === "generate") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const token = randomBytes(32).toString("hex");
    const { error } = await svc.from("instructor_invites").update({
      token_hash: hash(token), expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
      claimed_by: null, claimed_at: null
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, gate.ctx.profile.id, "invites.generate", "instructor_invites", id, null, null, {}, gate.ctx);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.json({ ok: true, token, link: `${base}/invite/${token}` });
  }

  if (action === "revoke") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const { error } = await svc.from("instructor_invites").update({ token_hash: null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, gate.ctx.profile.id, "invites.revoke", "instructor_invites", id, null, null, {}, gate.ctx);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const gate = await requirePerm(req, "users", "delete");
  if (!gate.ok) return gate.res;
  const { id } = await req.json().catch(() => ({} as any));
  if (!id) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { error } = await gate.ctx.svc.from("instructor_invites").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(gate.ctx.svc, gate.ctx.profile.id, "invites.delete", "instructor_invites", id, null, null, {}, gate.ctx);
  return NextResponse.json({ ok: true });
}

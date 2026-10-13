import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

function secret(): Uint8Array | null {
  const s = process.env.IMPERSONATION_SECRET;
  if (!s) return null;
  return new TextEncoder().encode(s);
}

/** GET current impersonation (for banners). POST start. DELETE stop. */
export async function GET(req: NextRequest) {
  const s = secret();
  const cookie = req.cookies.get("hudoor_viewas")?.value;
  if (!s || !cookie) return NextResponse.json({ active: null });
  try {
    const { payload } = await jwtVerify(cookie, s);
    return NextResponse.json({
      active: { targetId: payload.tid, email: payload.email, role: payload.role }
    });
  } catch {
    return NextResponse.json({ active: null });
  }
}

export async function POST(req: NextRequest) {
  const s = secret();
  if (!s) return NextResponse.json({ error: "viewas_not_configured" }, { status: 500 });
  const gate = await requirePerm(req, "users", "impersonate");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { userId } = body;
  if (!userId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: target } = await svc.from("profiles").select("id,email,role,custom_role,status").eq("id", userId).single();
  if (!target || (target as any).status !== "approved")
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((target as any).role === "admin")
    return NextResponse.json({ error: "cannot_impersonate_admin" }, { status: 400 });
  const token = await new SignJWT({
    aid: gate.ctx.profile.id,
    tid: (target as any).id,
    email: (target as any).email,
    role: (target as any).custom_role === "ta" ? "ta" : (target as any).role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(s);
  await auditDiff(svc, gate.ctx.profile.id, "users.impersonate_start", "profiles", (target as any).id, null, null, {}, gate.ctx);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("hudoor_viewas", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 30 * 60
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const s = secret();
  const gate = await requirePerm(req, "users", "view");
  if (!gate.ok) return gate.res;
  try {
    if (s) {
      const cookie = req.cookies.get("hudoor_viewas")?.value;
      if (cookie) {
        const { payload } = await jwtVerify(cookie, s);
        await auditDiff(gate.ctx.svc, gate.ctx.profile.id, "users.impersonate_stop", "profiles", String(payload.tid ?? ""), null, null, {}, gate.ctx);
      }
    }
  } catch {}
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("hudoor_viewas");
  return res;
}

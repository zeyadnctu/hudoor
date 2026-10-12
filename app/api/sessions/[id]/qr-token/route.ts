import { NextRequest, NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { signQrToken } from "@/lib/qr-token";

// GET /api/sessions/[id]/qr-token — professor/admin only; signs with server-side secret
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const svc = serviceSupabase();
  const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!prof || !["professor", "admin"].includes(prof.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: s } = await svc.from("attendance_sessions").select("id,secret,status,ends_at,professor_id").eq("id", params.id).single();
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (prof.role !== "admin" && s.professor_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (s.status !== "active") return NextResponse.json({ error: "ended" }, { status: 400 });
  const ttl = Number(process.env.QR_TOKEN_TTL_SECONDS ?? 15);
  const token = await signQrToken(s.secret, s.id, ttl);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.json({ token, url: `${base}/scan?t=${token}`, expiresIn: ttl });
}

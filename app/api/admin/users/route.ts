import { NextRequest, NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { z } = await import("zod");
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["student", "professor", "admin"])
  });
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { email, password, role } = body.data;

  // Create the auth user with email pre-confirmed (no email sending, no rate limit).
  const { data, error } = await ctx.svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { role }
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: e2 } = await ctx.svc.from("profiles").upsert(
    { id: data.user.id, email, role, status: "approved" },
    { onConflict: "id" }
  );
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  await audit(ctx.svc, ctx.adminId, "user_create", "profile", data.user.id, { email, role });
  return NextResponse.json({ ok: true, id: data.user.id });
}

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data } = await ctx.svc.auth.admin.listUsers({ perPage: 1000 });
  return NextResponse.json({ users: (data?.users ?? []).map(u => ({ id: u.id, email: u.email })) });
}

// @ts-nocheck
"use server";
import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/passkey/authenticate/finish
 * Body: { id, rawId, response: { authenticatorData, clientDataJSON, signature }, type }
 * Verifies the assertion and returns the matched user (email + id).
 */
export async function POST(req: NextRequest) {
  const challenge = req.cookies.get("hudoor_pk_auth_challenge")?.value ?? "";
  const origin = process.env.NEXT_PUBLIC_AUTH_ORIGIN ?? new URL(req.url).origin;

  const body = (await req.json()) as any;
  if (!body) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  let verification: any;
  try {
    verification = await verifyAuthenticationResponse({
      credential: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: new URL(origin).hostname,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "authentication_failed" }, { status: 400 });
  }

  const { registrationInfo } = verification;
  const svc = serviceSupabase();
  const credIdB64 = isoBase64URL.fromBuffer(registrationInfo.credentialID as ArrayBuffer);
  const { data: key } = await svc.from("passkeys")
    .select("user_id,credential_id,counter")
    .eq("credential_id", credIdB64)
    .maybeSingle();
  if (!key) {
    return NextResponse.json({ error: "unknown_credential" }, { status: 400 });
  }

  await svc.from("passkeys")
    .update({ counter: Number(registrationInfo.newCounter ?? 0), last_used_at: new Date().toISOString() })
    .eq("user_id", key.user_id);

  const { data: profile } = await svc.from("profiles")
    .select("id,email,role,status").eq("id", key.user_id).single();
  if (!profile || profile.status !== "approved") {
    return NextResponse.json({ error: "not_approved" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, user: { id: profile.id, email: profile.email, role: profile.role } });
  res.cookies.set("hudoor_pk_auth_challenge", "", { maxAge: 0, path: "/" });
  res.cookies.set("hudoor_pk_auth_user_id", "", { maxAge: 0, path: "/" });
  return res;
}

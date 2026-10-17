// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase-server";
import { serviceSupabase } from "@/lib/supabase-server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/passkey/register/finish
 * Body: { id, rawId, response: { clientDataJSON, attestationObject }, type }
 * Verifies attestation and stores the credential.
 */
export async function POST(req: NextRequest) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const challenge = req.cookies.get("hudoor_pk_challenge")?.value ?? "";
  const origin = process.env.NEXT_PUBLIC_AUTH_ORIGIN ?? new URL(req.url).origin;

  const body = (await req.json()) as any;
  if (!body) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  let verification: any;
  try {
    verification = await verifyRegistrationResponse({
      credential: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: new URL(origin).hostname,
      requireUserVerification: false,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "registration_failed" }, { status: 400 });
  }

  const { registrationInfo } = verification;
  const svc = serviceSupabase();
  const { error } = await svc.from("passkeys").insert({
    user_id: user.id,
    name: body.response?.deviceName ?? "Security key",
    credential_id: isoBase64URL.fromBuffer(registrationInfo.credentialID as ArrayBuffer),
    public_key: isoBase64URL.fromBuffer(registrationInfo.credentialPublicKey as ArrayBuffer),
    counter: Number(registrationInfo.counter ?? 0),
    transports: (body.response?.transports ?? []) as string[],
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("hudoor_pk_challenge", "", { maxAge: 0, path: "/" });
  res.cookies.set("hudoor_pk_user_id", "", { maxAge: 0, path: "/" });
  return res;
}

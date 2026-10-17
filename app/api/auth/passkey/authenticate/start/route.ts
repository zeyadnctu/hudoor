// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/passkey/authenticate/start
 * Body: { email }
 * Returns WebAuthn authentication options. Challenges bound to user's passkeys.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string };
  if (!body?.email) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  const svc = serviceSupabase();
  const { data: profile } = await svc.from("profiles").select("id,email").eq("email", body.email).maybeSingle();
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const { data: keys } = await svc.from("passkeys").select("credential_id").eq("user_id", profile.id);
  const allowCredentials = ((keys ?? []) as any[]).map((k: any) => ({
    id: isoBase64URL.toBuffer(k.credential_id),
    type: "public-key",
  }));

  const origin = process.env.NEXT_PUBLIC_AUTH_ORIGIN ?? new URL(req.url).origin;
  const rpID = new URL(origin).hostname;
  const challenge = isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(32)));

  const options: any = await generateAuthenticationOptions({
    rpID,
    challenge,
    allowCredentials: allowCredentials.length ? allowCredentials : undefined,
    userVerification: "preferred",
  });

  const res = NextResponse.json(options);
  res.cookies.set("hudoor_pk_auth_challenge", String(options.challenge), {
    httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"),
    maxAge: 300, path: "/",
  });
  res.cookies.set("hudoor_pk_auth_user_id", profile.id, {
    httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"),
    maxAge: 300, path: "/",
  });
  return res;
}

// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase-server";
import { serviceSupabase } from "@/lib/supabase-server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/passkey/register/start
 * Body: { userId, userName }
 * Returns WebAuthn registration options. Challenge stored in a cookie for /finish.
 */
export async function POST(req: NextRequest) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const svc = serviceSupabase();
  const { data: profile } = await svc.from("profiles").select("id,email,role").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const body = (await req.json()) as { userId?: string; userName?: string };
  if (!body?.userId || !body?.userName) return NextResponse.json({ error: "bad_input" }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_AUTH_ORIGIN ?? new URL(req.url).origin;
  const rpID = new URL(origin).hostname;
  const userIDBytes = new TextEncoder().encode(profile.id);

  const options: any = await generateRegistrationOptions({
    rpName: "Hudoor",
    rpID,
    userName: profile.email ?? body.userName,
    userID: userIDBytes,
    userDisplayName: body.userName,
    supportedCredentialTypes: [{ type: "public-key", algorithm: -7 }],
    supportedVersions: ["3.0"],
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    attestationType: "none",
  });

  const res = NextResponse.json(options);
  res.cookies.set("hudoor_pk_challenge", String(options.challenge), {
    httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"),
    maxAge: 300, path: "/",
  });
  res.cookies.set("hudoor_pk_user_id", profile.id, {
    httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"),
    maxAge: 300, path: "/",
  });
  return res;
}

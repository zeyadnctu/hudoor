import * as jose from "jose";
import { randomUUID } from "crypto";

export async function signQrToken(secret: string, sessionId: string, ttlSec = 15): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);
  return await new jose.SignJWT({ sid: sessionId, nonce: randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(key);
}

/** Read the global QR timing settings (rotation = how often the professor page
 *  mints a new code; ttl = how long a scanned token stays valid). */
export async function qrTimingSettings(svc: any): Promise<{ rotationSec: number; ttlSec: number }> {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  let rotation = Number(process.env.QR_ROTATION_SECONDS ?? 10);
  let ttl = Number(process.env.QR_TOKEN_TTL_SECONDS ?? 15);
  try {
    const { data: rows } = await svc.from("app_settings")
      .select("key,value").eq("scope_type", "global")
      .in("key", ["qr_rotation_seconds", "qr_token_ttl_seconds"]);
    const num = (k: string): number | null => {
      const v = ((rows ?? []) as any[]).find(r => r.key === k)?.value;
      const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
      return Number.isFinite(n) ? n : null;
    };
    rotation = num("qr_rotation_seconds") ?? rotation;
    ttl = num("qr_token_ttl_seconds") ?? ttl;
  } catch { /* fall back to env */ }
  rotation = clamp(Math.round(rotation), 5, 120);
  // A token must outlive the rotation that replaces it, or students scanning
  // between two codes would hit "expired_code".
  ttl = clamp(Math.max(rotation, Math.round(ttl)), 5, 300);
  return { rotationSec: rotation, ttlSec: ttl };
}

export async function verifyQrToken(secret: string, token: string): Promise<{ sid: string; nonce: string }> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, key, { algorithms: ["HS256"] });
  if (typeof payload.sid !== "string" || typeof payload.nonce !== "string") throw new Error("bad_claims");
  return { sid: payload.sid, nonce: payload.nonce };
}

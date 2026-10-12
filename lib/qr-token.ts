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

export async function verifyQrToken(secret: string, token: string): Promise<{ sid: string; nonce: string }> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, key, { algorithms: ["HS256"] });
  if (typeof payload.sid !== "string" || typeof payload.nonce !== "string") throw new Error("bad_claims");
  return { sid: payload.sid, nonce: payload.nonce };
}

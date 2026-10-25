/**
 * Local Supabase session JWT verification — the fast path.
 *
 * Why: every `supabase.auth.getUser()` is a network round trip to the Auth
 * server. The session cookie ALREADY carries the access JWT, and this project
 * publishes an ES256 signing key at /auth/v1/.well-known/jwks.json — so
 * middleware and API routes can authenticate with ZERO network calls in the
 * steady state (the first JWKS fetch per process is the only cost).
 *
 * Fallback chain: ES256 via public JWKS → HS256 legacy JWT secret (if set) →
 * network getUser() (the old path, also refreshes the session).
 *
 * Cookie layout (matches @supabase/ssr 0.5.x):
 *   name:  `sb-<project-ref>-auth-token`  (chunked into `…-token.0, .1, …`
 *          when the value exceeds 3180 chars; the main cookie is absent then)
 *   value: `base64-<base64url(stringified JSON session blob)>` or plain JSON
 *   blob fields used here: `access_token` (its `sub`/`exp` claims)
 */
import { base64url, createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { SUPABASE_JWT_SECRET } from "./env";

export type LocalUser = { id: string; exp: number };

export function authCookieName(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let ref = "";
  try { ref = new URL(url).host.split(".")[0]; } catch {}
  return ref ? `sb-${ref}-auth-token` : "sb-auth-token";
}

/**
 * Public asymmetric keys (current Supabase projects sign access tokens with
 * ES256 and publish the public half at /auth/v1/.well-known/jwks.json).
 * createRemoteJWKSet caches keys and refetches on unknown `kid`, so this is
 * effectively free after the first verification.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null | undefined;
function jwksClient(): ReturnType<typeof createRemoteJWKSet> | null {
  if (jwks === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    jwks = url
      ? createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", url), { cooldownDuration: 300_000 })
      : null;
  }
  return jwks;
}

type GetCookie = (name: string) => string | undefined;

/** Follow the exact @supabase/ssr chunking convention (main cookie first). */
export function readSessionValue(get: GetCookie): string | null {
  const name = authCookieName();
  const main = get(name);
  if (main) return main;
  let combined: string | null = null;
  for (let i = 0; ; i++) {
    const chunk = get(`${name}.${i}`);
    if (!chunk) break;
    combined = (combined ?? "") + chunk;
  }
  return combined;
}

function parseBlob(raw: string | null): { access_token?: string; expires_at?: number } | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    if (decoded.startsWith("base64-")) decoded = new TextDecoder().decode(base64url.decode(decoded.slice(7)));
  } catch { return null; }
  try { return JSON.parse(decoded); } catch { return null; }
}

/**
 * Verify the session cookie's access token locally. Returns null when the
 * cookie is missing / unreadable / fails all verification.
 *
 * Order: ES256 via public JWKS (no secrets needed) → HS256 legacy secret if
 * SUPABASE_JWT_SECRET is set → null (caller falls back to network getUser).
 */
export async function localSessionUser(getCookie: GetCookie): Promise<LocalUser | null> {
  const blob = parseBlob(readSessionValue(getCookie));
  const token = blob?.access_token;
  if (!token || typeof token !== "string") return null;
  let payload: { sub?: unknown; exp?: unknown } | null = null;
  const jwksClientRef = jwksClient();
  if (jwksClientRef) {
    try {
      payload = (await jwtVerify(token, jwksClientRef, { algorithms: ["ES256"] })).payload;
    } catch { /* try the legacy secret below */ }
  }
  if (!payload) {
    const secret = SUPABASE_JWT_SECRET();
    if (!secret) return null;
    try {
      payload = (await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] })).payload;
    } catch {
      return null;
    }
  }
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
  return { id: payload.sub, exp: payload.exp };
}

/** True when the (still-valid) token is close enough to expiry to prefer a refresh. */
export function expiringSoon(u: LocalUser, marginSec = 60): boolean {
  return u.exp - Date.now() / 1000 < marginSec;
}

/** Unverified sid/uid read for fastest paths that check again later. */
export function peekClaims(token: string): { sub?: string; exp?: number } | null {
  try { return decodeJwt(token) as { sub?: string; exp?: number }; } catch { return null; }
}

/** Parse a request `cookie:` header the way Next parses it. */
export function cookieLookupOf(header: string | null): GetCookie {
  if (!header) return () => undefined;
  const map = new Map<string, string>();
  for (const part of header.split(/; */)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    let v = part.slice(eq + 1).trim();
    try { v = decodeURIComponent(v); } catch {}
    map.set(k, v);
  }
  return (name) => map.get(name);
}

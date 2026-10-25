import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { base64url } from "jose";

/**
 * Drop auth cookie values that CLAIM to be `base64-<base64url>` but don't
 * actually decode: @supabase/ssr's cookie getItem() throws (no try/catch) on
 * such values, and the throw escapes auth-js's recovery promise as an
 * unhandled rejection that KILLS the whole serverless instance (Vercel logs:
 * "Node.js process exited with exit status: 128" → 500 to the client).
 * Any client can send `Cookie: sb-…-auth-token=base64-!!!` and crash an
 * instance doing that — so invalid values are treated as no session instead.
 * (Non-`base64-` values are safe: auth-js JSON.parses and treats garbage as
 * absent on its own.)
 */
function isSafeCookieValue(value: string): boolean {
  if (!value.startsWith("base64-")) return true;
  if (value.length > 100_000) return false;
  try {
    base64url.decode(value.slice(7)); // strict base64url; throws on +, /, spaces, "{", …
    return true;
  } catch {
    return false;
  }
}

// Server-only (API routes, server components). Never import from client components.
export function serverSupabase() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll().filter(c => isSafeCookieValue(c.value)),
        setAll: (all: { name: string; value: string; options?: CookieOptions }[]) => { try { all.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} }
      }
    }
  );
}

export function serviceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      // Never let Next's patched fetch memoize these reads: every API route
      // serves live data (scan verdicts, settings, session state), and a stale
      // auth/scan configuration would be a security bug.
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" })
      }
    }
  );
}

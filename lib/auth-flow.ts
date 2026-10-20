// Shared sign-in flow helpers for the login page and the OAuth callback.
// Pure + tiny fetch so both screens agree on domain rules and landing pages.

export type AuthConfig = {
  googleEnabled: boolean;
  restrictDomain: boolean;
  emailDomains: string[];
};

/** Open by default: a config outage must never lock everyone out. */
export const DEFAULT_AUTH_CONFIG: AuthConfig = { googleEnabled: true, restrictDomain: false, emailDomains: [] };

export async function fetchAuthConfig(): Promise<AuthConfig> {
  try {
    const r = await fetch("/api/auth/config", { cache: "no-store" });
    if (!r.ok) return DEFAULT_AUTH_CONFIG;
    const j = await r.json();
    return {
      googleEnabled: j.googleEnabled !== false,
      restrictDomain: j.restrictDomain === true,
      emailDomains: Array.isArray(j.emailDomains) ? j.emailDomains.map(String) : []
    };
  } catch {
    return DEFAULT_AUTH_CONFIG;
  }
}

/** University-domain gate (password + Google alike). */
export function domainAllowed(email: string | null | undefined, cfg: AuthConfig): boolean {
  if (!cfg.restrictDomain || !cfg.emailDomains.length) return true;
  const domain = (email ?? "").split("@").pop()?.trim().toLowerCase() ?? "";
  return !!domain && cfg.emailDomains.includes(domain);
}

/** Home shell per system role. */
export function homeFor(role: string | null | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "professor") return "/professor";
  return "/student";
}

/** Mirrors middleware.ts route gating, so the client never lands on a page
 *  that immediately bounces it back to /login (redirect ping-pong). */
export function canReach(role: string | null | undefined, path: string): boolean {
  const r = role ?? "student";
  const at = (prefix: string) => path === prefix || path.startsWith(prefix + "/");
  if (at("/admin")) return r === "admin" || r === "coordinator";
  if (at("/professor")) return r === "professor" || r === "admin";
  if (at("/student")) return r === "student" || r === "admin";
  return true;
}

/** Pick the post-login destination: honored `next` when the role may open it,
 *  otherwise the role's home. */
export function landingFor(role: string | null | undefined, next?: string | null): string {
  const home = homeFor(role);
  if (!next) return home;
  const path = next.startsWith("/") ? next : `/${next}`;
  if (path === "/login" || path === "/signup") return home;
  return canReach(role, path) ? path : home;
}

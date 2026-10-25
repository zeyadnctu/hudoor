import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { jwtVerify } from "jose";
import { localSessionUser, expiringSoon, type LocalUser } from "@/lib/jwt-local";

type ViewAs = { tid: string; email: string; role: string } | null;

async function viewAs(req: NextRequest): Promise<ViewAs> {
  const secret = process.env.IMPERSONATION_SECRET;
  const cookie = req.cookies.get("hudoor_viewas")?.value;
  if (!secret || !cookie) return null;
  try {
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret));
    if (payload.role === "admin") return null; // never escalate via view-as
    return { tid: String(payload.tid), email: String(payload.email ?? ""), role: String(payload.role ?? "student") };
  } catch {
    return null;
  }
}

/** Home shell per system role, custom_role aware (ta → professor, coordinator → admin). */
function roleHome(role: string, custom: string | null): string {
  if (custom === "ta") return "/professor";
  if (custom === "coordinator") return "/admin";
  if (role === "admin") return "/admin";
  if (role === "professor") return "/professor";
  return "/student";
}

const prefixOf = (p: string, prefix: string) => p === prefix || p.startsWith(prefix + "/");

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: { name: string; value: string; options?: any }[]) => { all.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); }
      }
    }
  );
  const path = req.nextUrl.pathname;
  const guarded = ["/admin", "/professor", "/student", "/onboarding"].some(p => prefixOf(path, p));
  const isAuthPage = path === "/login" || path === "/signup";
  const origin = req.nextUrl.origin;

  // FAST PATH: verify the session cookie's JWT locally (0 network calls).
  // Every navigation used to pay a round trip to the Auth server.
  let user: { id: string } | null = null;
  if (guarded || isAuthPage) {
    const local: LocalUser | null = await localSessionUser((name: string) => req.cookies.get(name)?.value);
    if (local && !expiringSoon(local)) {
      user = { id: local.id };
    } else if (guarded) {
      // Slow path (also refreshes the session + rewrites cookies when the
      // token was about to expire or verification was impossible locally).
      // Auth pages skip this on purpose: a signed-out visitor just gets the form.
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        user = u;
      } catch {
        user = null;
      }
    }
  }

  if (!user) {
    if (guarded) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    return res; // auth pages render normally for signed-out visitors
  }

  // One PostgREST call: role row + child student_details in the same embed
  // (previously three sequential round trips per navigation: auth + profile
  // + student_details).
  let profile: any = null; let hasStudentDetails: boolean | null = null;
  {
    const { data, error } = await supabase.from("profiles")
      .select("role,custom_role,status,is_active,student_details(id)")
      .eq("id", user.id).single();
    if (!error && data) {
      profile = data;
      hasStudentDetails = Array.isArray(data.student_details) ? data.student_details.length > 0 : false;
    }
  }
  if (!profile) {
    // Embed may be unavailable — degrade to the two separate lookups.
    const { data: p } = await supabase.from("profiles").select("role,custom_role,status,is_active").eq("id", user.id).single();
    if (!p) {
      // Profile row missing (login/signup inserts it, but that step can fail).
      // NEVER redirect /onboarding -> /onboarding: that is an infinite 307
      // loop. Let the onboarding page load and self-repair the row instead.
      if (!path.startsWith("/onboarding")) {
        return NextResponse.redirect(new URL("/onboarding", origin));
      }
      return res;
    }
    profile = p;
    if ((profile as any).role === "student") {
      const { data: det } = await supabase.from("student_details").select("id").eq("user_id", user.id).maybeSingle();
      hasStudentDetails = !!det;
    } else {
      hasStudentDetails = true;
    }
  }
  const p = profile as any;
  const role: string = p.role;
  const custom: string | null = p.custom_role ?? null;
  const isTa = role === "student" && custom === "ta";
  const blocked = p.status !== "approved" || p.is_active === false;

  // Signed-in users are NEVER shown the auth pages again: straight to where
  // they belong (unfinished profile → wizard, else their role home; a safe
  // `next` is honored only when this role may actually open it).
  if (isAuthPage) {
    if (blocked || (role === "student" && !isTa && hasStudentDetails === false)) {
      return NextResponse.redirect(new URL("/onboarding", origin));
    }
    const next = req.nextUrl.searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//") && !prefixOf(next, "/login") && !prefixOf(next, "/signup")) {
      const home = roleHome(role, custom);
      if (prefixOf(next, home)) return NextResponse.redirect(new URL(next, origin));
      // role-aware honor: student may follow /student links, professor /professor…
      if ((role === "admin" && prefixOf(next, "/admin")) || (prefixOf(next, roleHome(role, null)))) {
        return NextResponse.redirect(new URL(next, origin));
      }
    }
    return NextResponse.redirect(new URL(roleHome(role, custom), origin));
  }

  // New accounts (incl. Google sign-up) land with status "pending"; they must
  // still reach /onboarding to complete student_details. Approval gate applies
  // once they try to enter /student or other role routes.
  if (blocked && !path.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  // view-as: an admin previewing a student/professor/TA shell (route gating only;
  // data stays under RLS; banner + audit in the view-as API).
  const va = await viewAs(req);
  const effRole = va ? va.role : role;

  if (path === "/admin" || path.startsWith("/admin/")) {
    if (!(role === "admin" || role === "coordinator" || (custom !== null && custom !== "ta"))) {
      return NextResponse.redirect(new URL("/login", origin));
    }
  }
  if (path === "/professor" || path.startsWith("/professor/")) {
    if (!(effRole === "professor" || effRole === "admin" || effRole === "ta")) {
      return NextResponse.redirect(new URL("/login", origin));
    }
  }
  if (path === "/student" || path.startsWith("/student/")) {
    if (!(effRole === "student" || effRole === "admin" || effRole === "ta")) {
      return NextResponse.redirect(new URL("/login", origin));
    }
  }
  if (va) {
    // expose target to layouts/pages (read-only banner)
    res.headers.set("x-view-as", va.tid);
    res.headers.set("x-view-as-role", va.role);
  }
  // students with incomplete onboarding -> force wizard (skipped in view-as)
  if (!va && role === "student" && !isTa && hasStudentDetails === false && !path.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }
  // COMPLETED + approved students can never reopen the wizard — it is done.
  // (Previously the redirect only pulled incomplete users INTO it; the page
  // then also rendered for finished profiles until its client check ran.)
  if (!va && role === "student" && !isTa && hasStudentDetails === true && !blocked && path.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL("/student", origin));
  }
  return res;
}

export const config = { matcher: ["/admin/:path*", "/professor/:path*", "/student/:path*", "/onboarding", "/login", "/signup"] };

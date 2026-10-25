import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
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

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: { name: string; value: string; options?: CookieOptions }[]) => { all.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); }
      }
    }
  );
  const path = req.nextUrl.pathname;
  const guarded = ["/admin", "/professor", "/student", "/onboarding"].some(p => path === p || path.startsWith(p + "/"));

  // FAST PATH: verify the session cookie's JWT locally (0 network calls).
  // Every navigation used to pay a round trip to the Auth server.
  let user: { id: string } | null = null;
  const local: LocalUser | null = guarded
    ? await localSessionUser((name: string) => req.cookies.get(name)?.value)
    : null;
  if (local && !expiringSoon(local)) {
    user = { id: local.id };
  } else {
    // Slow path (also refreshes the session + rewrites cookies when the token
    // was about to expire or verification was impossible locally).
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;
  }

  if (guarded) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
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
        // Profile row missing (signup inserted it, but that step can fail).
        // NEVER redirect /onboarding -> /onboarding: that is an infinite 307
        // loop. Let the onboarding page load and self-repair the row instead.
        if (!path.startsWith("/onboarding")) {
          const url = req.nextUrl.clone(); url.pathname = "/onboarding"; return NextResponse.redirect(url);
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
    // New accounts (incl. Google sign-up) land with status "pending"; they must
    // still reach /onboarding to complete student_details. Approval gate applies
    // once they try to enter /student or other role routes.
    if (p.status !== "approved" || p.is_active === false) {
      if (!path.startsWith("/onboarding")) {
        const url = req.nextUrl.clone(); url.pathname = "/onboarding"; return NextResponse.redirect(url);
      }
    }
    const role: string = p.role;
    const custom: string | null = p.custom_role ?? null;
    const isTa = role === "student" && custom === "ta";

    // view-as: an admin previewing a student/professor/TA shell (route gating only;
    // data stays under RLS; banner + audit in the view-as API).
    const va = await viewAs(req);
    const effRole = va ? va.role : role;

    if (path === "/admin" || path.startsWith("/admin/")) {
      if (!(role === "admin" || role === "coordinator" || (custom !== null && custom !== "ta"))) {
        const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
      }
    }
    if (path === "/professor" || path.startsWith("/professor/")) {
      if (!(effRole === "professor" || effRole === "admin" || effRole === "ta")) {
        const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
      }
    }
    if (path === "/student" || path.startsWith("/student/")) {
      if (!(effRole === "student" || effRole === "admin" || effRole === "ta")) {
        const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
      }
    }
    if (va) {
      // expose target to layouts/pages (read-only banner)
      res.headers.set("x-view-as", va.tid);
      res.headers.set("x-view-as-role", va.role);
    }
    // students with incomplete onboarding -> force wizard (skipped in view-as)
    if (!va && role === "student" && !isTa && hasStudentDetails === false && !path.startsWith("/onboarding")) {
      const url = req.nextUrl.clone(); url.pathname = "/onboarding"; return NextResponse.redirect(url);
    }
  }
  return res;
}

export const config = { matcher: ["/admin/:path*", "/professor/:path*", "/student/:path*", "/onboarding"] };

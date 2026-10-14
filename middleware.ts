import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { jwtVerify } from "jose";

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
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const guard = (prefix: string) => path === prefix || path.startsWith(prefix + "/");
  if (guard("/admin") || guard("/professor") || guard("/student") || guard("/onboarding")) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    const { data: profile } = await supabase.from("profiles").select("role,custom_role,status").eq("id", user.id).single();
    if (!profile) {
      const url = req.nextUrl.clone(); url.pathname = "/onboarding"; return NextResponse.redirect(url);
    }
    const p = profile as any;
    if (p.status !== "approved" || p.is_active === false) {
      const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
    }
    const role: string = p.role;
    const custom: string | null = p.custom_role ?? null;
    const isTa = role === "student" && custom === "ta";

    // view-as: an admin previewing a student/professor/TA shell (route gating only;
    // data stays under RLS; banner + audit in the view-as API).
    const va = await viewAs(req);
    const effRole = va ? va.role : role;

    if (guard("/admin") && !(role === "admin" || role === "coordinator" || (custom !== null && custom !== "ta"))) {
      const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
    }
    if (guard("/professor") && !(effRole === "professor" || effRole === "admin" || effRole === "ta")) {
      const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
    }
    if (guard("/student") && !(effRole === "student" || effRole === "admin" || effRole === "ta")) {
      const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url);
    }
    if (va) {
      // expose target to layouts/pages (read-only banner)
      res.headers.set("x-view-as", va.tid);
      res.headers.set("x-view-as-role", va.role);
    }
    if (guard("/onboarding")) return res;
    // students with incomplete onboarding -> force wizard (skipped in view-as)
    if (!va && (role === "student" && !isTa)) {
      const { data: det } = await supabase.from("student_details").select("id").eq("user_id", user.id).maybeSingle();
      if (!det && !guard("/onboarding")) {
        const url = req.nextUrl.clone(); url.pathname = "/onboarding"; return NextResponse.redirect(url);
      }
    }
  }
  return res;
}

export const config = { matcher: ["/admin/:path*", "/professor/:path*", "/student/:path*", "/onboarding"] };

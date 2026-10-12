import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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
    const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();
    if (!profile) {
      const url = req.nextUrl.clone(); url.pathname = "/onboarding"; return NextResponse.redirect(url);
    }
    const role = (profile as any).role as string;
    if (guard("/admin") && role !== "admin") { const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url); }
    if (guard("/professor") && !(role === "professor" || role === "admin")) { const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url); }
    if (guard("/student") && !(role === "student" || role === "admin")) { const url = req.nextUrl.clone(); url.pathname = "/login"; return NextResponse.redirect(url); }
    if (guard("/onboarding")) return res;
    // students with incomplete onboarding -> force wizard
    if (role === "student") {
      const { data: det } = await supabase.from("student_details").select("id").eq("user_id", user.id).maybeSingle();
      if (!det && !guard("/onboarding")) {
        const url = req.nextUrl.clone(); url.pathname = "/onboarding"; return NextResponse.redirect(url);
      }
    }
  }
  return res;
}

export const config = { matcher: ["/admin/:path*", "/professor/:path*", "/student/:path*", "/onboarding"] };
